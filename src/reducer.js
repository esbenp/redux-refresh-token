import {
  CLEAR_REFRESH_TOKEN_PROMISE,
  SAVE_REFRESH_TOKEN_PROMISE
} from "./actions";

const initialState = {
  refreshTokenPromise: null
};

export default function refreshReducer(state = initialState, action) {
  switch (action.type) {
    case CLEAR_REFRESH_TOKEN_PROMISE:
      return Object.assign({}, state, {
        refreshTokenPromise: initialState.refreshTokenPromise
      });
    case SAVE_REFRESH_TOKEN_PROMISE:
      return Object.assign({}, state, {
        refreshTokenPromise: action.promise
      });
    default:
      return state;
  }
}
