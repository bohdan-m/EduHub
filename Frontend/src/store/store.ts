import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../utils/types/user";

interface UserState {
    user: User | null;
    setUser: (user: User) => void;
    logout: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user: User) => set({ user }),
            logout: () => set({ user: null }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
