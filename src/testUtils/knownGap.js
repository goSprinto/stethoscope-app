// Jest 27 has no test.failing: this passes while the gap exists and fails once the assertion inside starts passing.
export const knownGap = (title, assertion) =>
  test(title, async () => {
    let failure = null
    try {
      await assertion()
    } catch (error) {
      failure = error
    }
    if (failure === null) throw new Error('the gap is closed: turn this into a normal test')
  })
