import axios from "axios";

function extractMessage(value: unknown): string | null {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const message = extractMessage(item);
            if (message) {
                return message;
            }
        }

        return null;
    }

    if (value && typeof value === "object") {
        for (const nestedValue of Object.values(value)) {
            const message = extractMessage(nestedValue);
            if (message) {
                return message;
            }
        }
    }

    return null;
}

export function getApiErrorMessage(err: unknown, fallback = "Error! Check your data"): string {
    if (!axios.isAxiosError(err)) {
        return fallback;
    }

    const data = err.response?.data;

    if (typeof data?.detail === "string") {
        return data.detail;
    }

    if (typeof data?.message === "string") {
        return data.message;
    }

    const extractedMessage = extractMessage(data);
    if (extractedMessage) {
        return extractedMessage;
    }

    return fallback;
}
