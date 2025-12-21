import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../utils/types/user";

interface UserState {
    user: User | null;
    setUser: (user: User) => void;
    updateTokens: (access: string, refresh?: string) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            user: null,
            
            setUser: (user: User) => set({ user }),
            
            updateTokens: (access: string, refresh?: string) => 
                set((state) => ({
                    user: state.user 
                        ? { ...state.user, access, refresh: refresh ?? state.user.refresh }
                        : null
                })),
            
            logout: () => {
                set({ user: null });
            },
            
            isAuthenticated: () => {
                const user = get().user;
                return !!(user?.access && user?.refresh);
            },
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
