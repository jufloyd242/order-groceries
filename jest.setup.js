// Jest setup - clear session storage between tests
beforeEach(() => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }
})
