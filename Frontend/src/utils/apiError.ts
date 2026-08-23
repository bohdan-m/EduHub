import axios from "axios";

export function getApiErrorMessage(err: unknown): string {
    if (!axios.isAxiosError(err)) {
        return "Error! Check your data";
    }

    const data = err.response?.data;

    if (typeof data?.detail === "string") {
        return data.detail;
    }

    if (typeof data?.message === "string") {
        return data.message;
    }

    if (data && typeof data === "object") {
        const firstValue = Object.values(data)[0];

        if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
            return firstValue[0];
        }

        if (typeof firstValue === "string") {
            return firstValue;
        }
    }

    return "Error! Check your data";
}
