--!nolint LocalShadow
-- Headless test runner: runs compiled roblox-ts tests under Lune, without Roblox Studio.
--
-- Why a custom runner: roblox-ts compiles a *game* project to absolute paths such as
-- `require(game:GetService("ReplicatedStorage"):WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))`.
-- Lune has no `game`, and the shim bundled with @rbxts/lunit only handles *package* output
-- (`_G[script]`). So this file fakes the small slice of the DataModel that compiled code touches,
-- mapping it to folders on disk with the same layout as default.project.json:
--
--   ReplicatedStorage.rbxts_include               -> include/
--   ReplicatedStorage.rbxts_include.node_modules  -> node_modules/
--   ReplicatedStorage.TS                          -> out/shared/
--   ServerScriptService.TS                        -> out/server/
--   StarterPlayer.StarterPlayerScripts.TS         -> out/client/
--
-- Only pure logic is meant to run here (CLAUDE.md rule 3). Code that needs real Roblox
-- services will fail loudly, which is the intended signal that it does not belong in shared logic.
--
-- The TS runtime helpers below are adapted from @rbxts/lunit/scripts/lune-shim.luau (MIT, Brandon Kong).
--
-- Usage: lune run scripts/run-tests.luau [tests-root]   (default tests-root: out)

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local process = require("@lune/process")
local stdio = require("@lune/stdio")
local task = require("@lune/task")

local LUNIT_SCRIPTS = "../node_modules/@rbxts/lunit/scripts"
local Promise = require(LUNIT_SCRIPTS .. "/promise")
local reporter = require(LUNIT_SCRIPTS .. "/lune-reporter")

local testsRoot = process.args[1] or "out"

local function warn(...)
	local parts = table.pack(...)
	for i = 1, parts.n do
		parts[i] = tostring(parts[i])
	end
	stdio.ewrite(stdio.color("yellow") .. table.concat(parts, "\t", 1, parts.n) .. stdio.color("reset") .. "\n")
end

--------------------------------------------------------------------------------
-- Fake instances
--------------------------------------------------------------------------------

-- Sentinel returned for `rbxts_include.RuntimeLib`; `require` hands back the TS runtime for it.
local RUNTIME_LIB = setmetatable({}, {
	__tostring = function()
		return "RuntimeLib"
	end,
})

local nodeByPath = {}

-- A fake Instance backed by a filesystem path. `overrides` maps child names to other nodes,
-- used where the DataModel layout differs from the folder layout.
local function makeNode(path: string, overrides: { [string]: any }?)
	local key = path .. if overrides then "#virtual" else ""
	local existing = nodeByPath[key]
	if existing then
		return existing
	end

	local node = { __path = path }
	local function child(name: string)
		if overrides and overrides[name] ~= nil then
			return overrides[name]
		end
		return makeNode(path .. "/" .. name)
	end
	function node.WaitForChild(_self, name: string)
		return child(name)
	end
	function node.FindFirstChild(_self, name: string)
		return child(name)
	end
	setmetatable(node, {
		__index = function(_, name)
			if name == "Parent" then
				local cut = string.find(path, "/[^/]*$")
				return if cut then makeNode(string.sub(path, 1, cut - 1)) else nil
			end
			return child(name)
		end,
		__tostring = function()
			return "Instance(" .. path .. ")"
		end,
	})
	nodeByPath[key] = node
	return node
end

local services = {
	ReplicatedStorage = makeNode("ReplicatedStorage", {
		TS = makeNode("out/shared"),
		rbxts_include = makeNode("include", {
			RuntimeLib = RUNTIME_LIB,
			node_modules = makeNode("node_modules"),
		}),
	}),
	ServerScriptService = makeNode("ServerScriptService", { TS = makeNode("out/server") }),
	StarterPlayer = makeNode("StarterPlayer", {
		StarterPlayerScripts = makeNode("StarterPlayerScripts", { TS = makeNode("out/client") }),
	}),
}

local game = {}
function game.GetService(_self, name: string)
	local service = services[name]
	if service == nil then
		error("Service '" .. name .. "' is not available in headless tests. Keep Roblox API calls out of tested logic.", 2)
	end
	return service
end

--------------------------------------------------------------------------------
-- Module loading
--------------------------------------------------------------------------------

local cache = {}
local loadModule
local TS

local function resolveFile(path: string): string?
	for _, candidate in { path .. ".luau", path .. ".lua", path .. "/init.luau", path .. "/init.lua" } do
		if fs.isFile(candidate) then
			return candidate
		end
	end
	return nil
end

local function fakeRequire(target)
	if target == RUNTIME_LIB then
		return TS
	end
	return loadModule(target)
end

function loadModule(node)
	local path = node.__path
	if path == nil then
		error("cannot require " .. tostring(node), 2)
	end
	local cached = cache[path]
	if cached ~= nil then
		return cached
	end

	local filePath = resolveFile(path)
	if not filePath then
		error("module not found: " .. path, 2)
	end

	-- Package output (e.g. lunit itself) reads its runtime from `_G[script]`.
	_G[node] = TS

	-- Loaded chunks do not inherit our locals, so pass the Roblox-flavoured globals in explicitly.
	local source = "local script, game, require, task, warn = ...\n" .. fs.readFile(filePath)
	local chunk = luau.load(source, { debugName = filePath })
	local result = chunk(node, game, fakeRequire, task, warn)
	cache[path] = result
	return result
end

--------------------------------------------------------------------------------
-- TS runtime helpers (subset of roblox-ts RuntimeLib)
--------------------------------------------------------------------------------

TS = { Promise = Promise }

function TS.import(_caller, module, ...)
	local target = module
	for i = 1, select("#", ...) do
		target = target[(select(i, ...))]
	end
	return fakeRequire(target)
end

function TS.async(callback)
	return function(...)
		local args = table.pack(...)
		return Promise.new(function(resolve, reject)
			coroutine.wrap(function()
				local ok, result = pcall(callback, table.unpack(args, 1, args.n))
				if ok then
					resolve(result)
				else
					reject(result)
				end
			end)()
		end)
	end
end

function TS.await(p)
	if not Promise.is(p) then
		return p
	end
	local status, value = p:awaitStatus()
	if status == Promise.Status.Resolved then
		return value
	elseif status == Promise.Status.Rejected then
		error(value, 2)
	end
	error("The awaited Promise was cancelled", 2)
end

function TS.instanceof(obj, class)
	if type(class) == "table" and type(class.instanceof) == "function" then
		return class.instanceof(obj)
	end
	if type(obj) == "table" then
		obj = getmetatable(obj)
		while obj ~= nil do
			if obj == class then
				return true
			end
			local mt = getmetatable(obj)
			obj = mt and mt.__index or nil
		end
	end
	return false
end

TS.TRY_RETURN = 1
TS.TRY_BREAK = 2
TS.TRY_CONTINUE = 3

function TS.try(try, catchFn, finallyFn)
	local trySuccess, exitTypeOrTryError, returns = pcall(try)
	local exitType, tryError
	if trySuccess then
		exitType = exitTypeOrTryError
	else
		tryError = exitTypeOrTryError
	end

	local catchSuccess, catchError = true, nil
	if not trySuccess and catchFn then
		local newExitTypeOrCatchError, newReturns
		catchSuccess, newExitTypeOrCatchError, newReturns = pcall(catchFn, tryError)
		local newExitType
		if catchSuccess then
			newExitType = newExitTypeOrCatchError
		else
			catchError = newExitTypeOrCatchError
		end
		if newExitType then
			exitType, returns = newExitType, newReturns
		end
	end

	if finallyFn then
		local newExitType, newReturns = finallyFn()
		if newExitType then
			exitType, returns = newExitType, newReturns
		end
	end

	if exitType ~= TS.TRY_RETURN and exitType ~= TS.TRY_BREAK and exitType ~= TS.TRY_CONTINUE then
		if not catchSuccess then
			error(catchError, 2)
		end
		if not trySuccess and not catchFn then
			error(tryError, 2)
		end
	end

	return exitType, returns
end

function TS.bit_lrsh(a, b)
	return bit32.arshift(a, b)
end

--------------------------------------------------------------------------------
-- Discover and run
--------------------------------------------------------------------------------

local function isTestFile(name: string): boolean
	return string.match(name, "%.test%.luau$") ~= nil or string.match(name, "%.spec%.luau$") ~= nil
end

local function discover(root: string, found: { string })
	if not fs.isDir(root) then
		return found
	end
	for _, name in fs.readDir(root) do
		local path = root .. "/" .. name
		if fs.isDir(path) then
			discover(path, found)
		elseif isTestFile(name) then
			table.insert(found, (string.gsub(path, "%.luau$", "")))
		end
	end
	return found
end

local lunit = loadModule(makeNode("node_modules/@rbxts/lunit/out"))

local testFiles = discover(testsRoot, {})
table.sort(testFiles)

local classes = {}
for _, modulePath in testFiles do
	local cls = loadModule(makeNode(modulePath))
	if cls ~= nil then
		table.insert(classes, cls)
	end
end

if #classes == 0 then
	stdio.ewrite("No *.test.ts files found under " .. testsRoot .. "\n")
	process.exit(1)
end

local result = lunit.TestRunner:fromClasses(classes):run({ reporter = reporter }):expect()
process.exit(if result.numTestsFailed > 0 then 1 else 0)
