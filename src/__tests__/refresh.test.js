import { applyMiddleware, createStore, combineReducers } from "redux";
import thunk from "redux-thunk";
import { SET_ACCESS_TOKEN, setAccessToken } from "../actions";
import refreshReducer from "../reducer";
import attemptRefresh from "../attemptRefresh";
import merge from "lodash/merge";
import qs from "query-string";

const CALL_API = "Call API";

const TOKEN_REFRESH_REQUEST = "TOKEN_REFRESH_REQUEST";
const TOKEN_REFRESH_SUCCESS = "TOKEN_REFRESH_SUCCESS";
const TOKEN_REFRESH_FAILURE = "TOKEN_REFRESH_FAILURE";

const attemptAccessTokenRefresh = () => ({
  [CALL_API]: {
    endpoint: "/login/refresh",
    method: "POST",
    types: [TOKEN_REFRESH_REQUEST, TOKEN_REFRESH_SUCCESS, TOKEN_REFRESH_FAILURE]
  }
});

const createLoggingMiddleware = ({ actions }) =>
  store =>
    next =>
      action => {
        actions.push(action);
        return next(action);
      };

const createBaseApiMiddleware = (
  { accessTokenMapping = {}, actions, refreshCode }
) =>
  store =>
    next =>
      action => {
        if (!action[CALL_API]) {
          return next(action);
        }

        const options = action[CALL_API];
        let {
          endpoint,
          method,
          body,
          headers = {},
          meta = {},
          query,
          payload,
          types
        } = options;

        if (query) {
          endpoint += "?" + qs.stringify(query);
        }

        headers["Content-Type"] = "application/json";

        const token = store.getState().token.access_token;
        if (typeof token === "string") {
          headers.Authorization = `Bearer ${token}`;
        }

        const { dispatch } = store;

        let useCode = meta.httpStatusCode;
        if (!useCode) {
          useCode = accessTokenMapping[token];
        }
        if (!useCode) {
          useCode = 200;
        }

        next({
          type: types[0],
          endpoint,
          method: options.method,
          body: options.body
        });

        return new Promise((resolve, reject) => {
          setTimeout(
            () => {
              if (useCode >= 200 && useCode < 300) {
                resolve({
                  type: types[1],
                  error: false,
                  payload
                });
              } else {
                resolve({
                  type: types[2],
                  error: true,
                  payload: {
                    status: useCode
                  }
                });
              }
            },
            1
          );
        }).then(
          attemptRefresh({
            action,
            endpoint,
            failure: logoutUser,
            next,
            refreshActionCreator: createRefreshActionCreator(refreshCode),
            store,
            token
          })
        );
      };

const createRefreshActionCreator = (code = 200) =>
  () => {
    const action = attemptAccessTokenRefresh();
    return Object.assign(action, {
      [CALL_API]: Object.assign({}, action[CALL_API], {
        meta: {
          httpStatusCode: code
        },
        payload: code === 200
          ? {
              accessToken: "200",
              accessTokenExpiration: "some date"
            }
          : {}
      })
    });
  };

const tokenMappings = {
  "200": 200,
  "400": 400,
  "401": 401
};

const LOGOUT_USER = "LOGOUT_USER";
export const logoutUser = () => {
  return dispatch => {
    dispatch({
      type: LOGOUT_USER
    });
    return new Promise(resolve => {
      resolve();
    });
  };
};

const initialTokenState = {
  access_token: null,
  expires_in: null
};

function accessTokenReducer(state = initialTokenState, action) {
  switch (action.type) {
    case LOGOUT_USER:
      return Object.assign({}, state, initialTokenState);
    case SET_ACCESS_TOKEN:
      return Object.assign({}, state, {
        access_token: action.access_token,
        expires_in: action.expires_in
      });
    default:
      return state;
  }
}

const createStoreMock = (
  {
    accessTokenMapping = tokenMappings,
    actions,
    initialState,
    refreshCode = 200
  }
) => {
  const middleware = [
    thunk,
    createBaseApiMiddleware({
      accessTokenMapping,
      actions,
      refreshCode
    }),
    createLoggingMiddleware({
      actions
    })
  ];

  return createStore(
    combineReducers({
      tokenRefresh: refreshReducer,
      token: accessTokenReducer
    }),
    merge(
      {
        token: {
          access_token: "401"
        }
      },
      initialState
    ),
    applyMiddleware(...middleware)
  );
};

const TEST_FETCH_REQUEST = "TEST_FETCH_REQUEST";
const TEST_FETCH_SUCCESS = "TEST_FETCH_SUCCESS";
const TEST_FETCH_FAILURE = "TEST_FETCH_FAILURE";

const testFetch = yo => ({
  [CALL_API]: {
    endpoint: "/endpoint",
    method: "GET",
    query: {
      test: yo
    },
    types: [TEST_FETCH_REQUEST, TEST_FETCH_SUCCESS, TEST_FETCH_FAILURE],
    payload: {
      body: true
    }
  }
});

const countActionTypes = actions =>
  actions.reduce(
    (carry, action) => {
      if (!carry[action.type]) {
        carry[action.type] = 0;
      }
      carry[action.type]++;
      return carry;
    },
    {}
  );

describe("API middlware", () => {
  it("should convert an API action properly", () => {
    const actions = [];
    const store = createStoreMock({
      actions,
      initialState: {
        token: {
          access_token: '200'
        }
      }
    });

    return store.dispatch(testFetch("1234")).then(response => {
      const requestAction = actions[0];
      const successAction = actions[1];

      expect(requestAction.endpoint).toEqual("/endpoint?test=1234");
      expect(successAction.type).toEqual(TEST_FETCH_SUCCESS);
      expect(successAction.error).toEqual(false);
      expect(successAction.payload).toEqual({ body: true });
    });
  });

  it("should attempt to refresh on 401s", () => {
    const actions = [];
    const store = createStoreMock({ actions });

    return store.dispatch(testFetch("1234")).then(response => {
      const firstFailAction = actions[1];
      const refreshSuccess = actions[4];
      const setToken = actions[6];
      const postRefreshAction = actions[7];
      const postRefreshActionSuccess = actions[8];

      expect(firstFailAction.type).toEqual(TEST_FETCH_FAILURE);
      expect(firstFailAction.payload.status).toEqual(401);
      expect(refreshSuccess.type).toEqual(TOKEN_REFRESH_SUCCESS);
      expect(refreshSuccess.payload.accessToken).toEqual("200");
      expect(setToken.type).toEqual(SET_ACCESS_TOKEN);
      expect(postRefreshAction.type).toEqual(TEST_FETCH_REQUEST);
      expect(postRefreshActionSuccess.type).toEqual(TEST_FETCH_SUCCESS);
      expect(response.payload.body).toEqual(true);
    });
  });

  it("should queue subsequent actions until 401 is resolved", () => {
    const actions = [];
    const store = createStoreMock({ actions });

    const action1 = store.dispatch(testFetch("1"));
    const action2 = store.dispatch(testFetch("2"));
    const action3 = store.dispatch(testFetch("3"));

    return Promise.all([action1, action2, action3]).then(response => {
      const counts = countActionTypes(actions);

      expect(counts[TEST_FETCH_FAILURE]).toEqual(3);

      const last6 = actions.slice(actions.length - 6);
      const last6Counts = countActionTypes(last6);

      expect(last6Counts[TEST_FETCH_REQUEST]).toEqual(3);
      expect(last6Counts[TEST_FETCH_SUCCESS]).toEqual(3);
      expect(last6Counts[TEST_FETCH_FAILURE]).toEqual(undefined);
    });
  });

  it("should log out user on errorneous refresh", () => {
    const actions400 = [];
    const store400 = createStoreMock({ actions: actions400, refreshCode: 400 });
    const actions401 = [];
    const store401 = createStoreMock({ actions: actions401, refreshCode: 401 });

    const runExpectations = actions => {
      const count = countActionTypes(actions);

      expect(count[TEST_FETCH_FAILURE]).toEqual(1);
      expect(count[TOKEN_REFRESH_FAILURE]).toEqual(1);
      expect(count[TEST_FETCH_SUCCESS]).toEqual(undefined);
      expect(actions[actions.length - 1].type).toEqual(LOGOUT_USER);
    };

    const promise400 = store400.dispatch(testFetch("1234"));
    const promise401 = store401.dispatch(testFetch("1234"));

    return Promise.all([promise400, promise401]).then(response => {
      runExpectations(actions400);
      runExpectations(actions401);
    });
  });

  it("should skip the refresh flow if no access token exists (e.g. on login calls)", () => {
    const actions = [];
    const store = createStoreMock({
      actions,
      initialState: {
        tokenRefresh: {
          accessToken: {
            token: null
          }
        }
      }
    });

    const action = testFetch("1234");
    action[CALL_API].meta = {
      httpStatusCode: 401
    };

    return store.dispatch(action).catch(() => {
      expect(actions[0].type).toEqual(TEST_FETCH_REQUEST);
      expect(actions[1].type).toEqual(TEST_FETCH_FAILURE);
    });
  });
});
