import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import { getApiErrorMessage } from "../src/utils/apiError.js";

test("returns fallback for non-axios errors", () => {
    assert.equal(getApiErrorMessage(new Error("boom")), "Error! Check your data");
});

test("reads detail field from axios response", () => {
    const error = new AxiosError(
        "Request failed",
        "400",
        undefined,
        undefined,
        { data: { detail: "Invalid credentials" } } as never,
    );

    assert.equal(getApiErrorMessage(error), "Invalid credentials");
});

test("reads first validation error from axios response arrays", () => {
    const error = new AxiosError(
        "Request failed",
        "400",
        undefined,
        undefined,
        { data: { email: ["User with this email already exists."] } } as never,
    );

    assert.equal(getApiErrorMessage(error), "User with this email already exists.");
});
