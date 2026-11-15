// Which vehicle the design studio edits: 'draft' (the next design) or a model id chosen in the garage.
import { create } from 'zustand';
export const useStudio = create<{ target: string; open: (target: string) => void }>((set) => ({ target: 'draft', open: (target) => set({ target }) }));
