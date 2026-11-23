const localStoreMock = jest.requireMock('../utils/localStore') as {
  __store: Map<string, string>;
  __reset: () => void;
  setItemSync: jest.Mock;
};

describe('localStoreMock adapter parity', () => {
  afterEach(() => {
    localStoreMock.__reset();
  });

  it('setItemSync mirrors the real adapter: rejects non-string values with TypeError', () => {
    expect(() =>
      localStoreMock.setItemSync('k', null as unknown as string)
    ).toThrow(TypeError);
    expect(() =>
      localStoreMock.setItemSync('k', 42 as unknown as string)
    ).toThrow(TypeError);
    expect(localStoreMock.__store.has('k')).toBe(false);

    localStoreMock.setItemSync('k', 'v');
    expect(localStoreMock.__store.get('k')).toBe('v');
  });
});
