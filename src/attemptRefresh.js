import {
  clearRefreshTokenPromise,
  saveRefreshTokenPromise,
  setAccessToken as defaultSetAcessTokenActionCreator
} from "./actions";

export default function attemptRefresh(settings) {
  const {
    action,
    failure,
    isRefreshCall = defaultIsRefreshCall,
    next,
    refreshActionCreator,
    refreshReducerKey = "tokenRefresh",
    setAccessTokenActionCreator = defaultSetAcessTokenActionCreator,
    store,
    token
  } = settings;

  return response => {
    // The API call returned unauthorized user (access token is expired)
    if (
      response.error && 
      response.payload.status === 401 &&
      // The refresh endpoint might return 401, so we skip the check here
      // otherwise we get stuck in an infinite loop
      !isRefreshCall(action, refreshActionCreator()) &&
      // We should not run the refresh flow when no token was given to begin with
      // (for instance Forgot Password, Login etc.)
      typeof token === "string" &&
      token.length > 0
    ) {
      // This will ensure that the fail action goes all the way to the bottom
      next(response)

      // We check if there is already dispatched a call to refresh the token,
      // if so we can simply queue the call until the refresh request completes
      let refreshPromise = store.getState()[
        refreshReducerKey
      ].refreshTokenPromise;

      if (!refreshPromise) {
        refreshPromise = requestNewAccessToken({
          store,
          next,
          setAccessTokenActionCreator,
          refreshActionCreator
        });

        next(saveRefreshTokenPromise(refreshPromise));
      }

      // When the refresh attempt is done, we fire all the actions that have been queued until
      // its completion. If, the refresh promise was unsuccessful we logout the user.
      return refreshPromise.then(response => {
        if (!response.error) {
          return store.dispatch(action);
        }

        return (
          store
            .dispatch(failure())
            // Ensure subscribers do not get an empty response, e.g. T512
            .then(response => ({ error: true }))
        );
      });
    }

    return next(response);
  };
}

const requestNewAccessToken = (
  {
    store,
    next,
    setAccessTokenActionCreator,
    refreshActionCreator
  }
) => {
  return store.dispatch(refreshActionCreator()).then(response => { // Refresh was successful
    next(clearRefreshTokenPromise());

    // Refresh was successful
    if (!response.error) {
      next(setAccessTokenActionCreator(response.payload));

      return {
        error: false
      };
    }

    return {
      error: true
    };
  });
};

const defaultIsRefreshCall = (action, refreshAction) => {
  return action["Call API"].endpoint === refreshAction["Call API"].endpoint;
};

export const createFSAConverter = (successType, failureType) => {
  return response => {
    const contentType = response.headers.get("Content-Type");
    const emptyCodes = [204, 205];

    if (!response.ok) {

      if (
        contentType &&
        contentType.indexOf("json") !== -1
      ) {
        const creatFailureType = async (response) => ({
          payload: {
            status: response.status,
            ... await response.json()
          },
          error: true,
          type: failureType
        })

        return creatFailureType(response)
      } else {
        return {
          error: true,
          payload: {
            status: response.status
          },
          type: failureType
        }
      }
    }
  
    const createSuccessType = payload => ({
      payload,
      type: successType
    })

    if (
      emptyCodes.indexOf(response.status) === -1 &&
      contentType &&
      contentType.indexOf("json") !== -1
    ) {
      return response.json().then(createSuccessType);
    } else {
      return createSuccessType();
    }
  }
};
