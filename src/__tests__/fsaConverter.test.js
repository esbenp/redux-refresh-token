import { createFSAConverter } from '../index'

describe("createFSAConverter", () => {
  const converter = createFSAConverter('Success', 'Failure')
  const headers = {get: () => 'application/json'}

  it('should not try to convert 204s and 205s', () => {
    const response204 = converter({
      ok: true,
      status: 204,
      headers
    })

    const response205 = converter({
      ok: true,
      status: 205,
      headers
    })

    expect(response204.type).toEqual('Success')
    expect(response204.payload).toEqual()
    expect(response205.type).toEqual('Success')
    expect(response205.payload).toEqual()
  })

  it('should return error object for non-oks', () => {
    const response = converter({
      ok: false,
      status: 401
    })

    expect(response.type).toEqual('Failure')
    expect(response.payload.status).toEqual(401)
  })

  it('should return json for successful requests', () => {
    const response = converter({
      ok: true,
      status: 200,
      json: () => Promise.resolve({yo: true}),
      headers
    })

    return response.then(response => {
      expect(response.type).toEqual('Success')
      expect(response.payload).toEqual({yo: true})
    })
  })
})