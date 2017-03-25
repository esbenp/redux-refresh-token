export const CLEAR_REFRESH_TOKEN_PROMISE = 'CLEAR_REFRESH_TOKEN_PROMISE'
export const SAVE_REFRESH_TOKEN_PROMISE = 'SAVE_REFRESH_TOKEN_PROMISE'
export const SET_ACCESS_TOKEN = 'SET_ACCESS_TOKEN'

export const clearRefreshTokenPromise = () => ({
  type: CLEAR_REFRESH_TOKEN_PROMISE
})

export const saveRefreshTokenPromise = promise => ({
  type: SAVE_REFRESH_TOKEN_PROMISE,
  promise
})

export const setAccessToken = ({ access_token, expires_in }) => ({
  type: SET_ACCESS_TOKEN,
  access_token,
  expires_in
})