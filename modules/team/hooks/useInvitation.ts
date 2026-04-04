export const useInvitation = (_staffId: string) => {
  return {
    invitation: null as any,
    createInvitation: async (_email: string) => {},
    cancelInvitation: async () => {},
  };
};
