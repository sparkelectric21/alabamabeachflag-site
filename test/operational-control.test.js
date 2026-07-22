import test from "node:test";
import assert from "node:assert/strict";
import { CONTROL_ENDPOINT, IMPACT, classifyControlFailure, expiryForPreset, requiresCriticalConfirmation, validateTransition } from "../admin/operational-control/core.js";

test("uses protected same-origin operational-control endpoint", () => assert.equal(CONTROL_ENDPOINT, "/admin/service/admin/operational-control"));
test("previews provider inheritance and independent Orange Beach impact", () => { assert.match(IMPACT["providers.gulfShoresFlags"], /Fort Morgan/); assert.match(IMPACT["providers.orangeBeachFlags"], /Orange Beach locations only/); });
test("requires critical confirmation for broad disables", () => { assert.equal(requiresCriticalConfirmation("global.liveData", "disabled"), true); assert.equal(requiresCriticalConfirmation("providers.orangeBeachFlags", "disabled"), false); });
test("validates expiry and restore reasons", () => { const now = new Date("2026-07-21T20:00:00Z"); assert.deepEqual(validateTransition({ controlId: "domains.beachFlags", state: "disabled", reasonCode: "data_integrity", operatorReason: "Mismatch", expiresAt: expiryForPreset("1h", now) }, now), {}); assert.ok(validateTransition({ controlId: "domains.beachFlags", state: "disabled", reasonCode: "", operatorReason: "", expiresAt: null }, now).expiresAt); });
test("surfaces revision conflicts", () => assert.match(classifyControlFailure({ status: 412, redirected: false }), /another session/));
