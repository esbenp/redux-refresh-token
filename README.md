# redux-refresh-token
=====================

[![Build Status](https://travis-ci.org/esbenp/redux-refresh-token.svg?branch=master)](https://travis-ci.org/esbenp/redux-refresh-token) [![Coverage Status](https://coveralls.io/repos/esbenp/redux-refresh-token/badge.svg?branch=master&service=github)](https://coveralls.io/github/esbenp/redux-refresh-token?branch=master)

Extension to your API middleware to refresh access tokens when a request hits a 401 response (access token expired).

## Introduction

If you use transient (short-lived) OAuth tokens for authentication then these will expire all the time. However, instead of logging 
the user out every time the token expires it is much better to simply request a new token using the refresh token.

If you use [Redux](https://redux.js.org) you are surely using an API middleware for requesting an API. You might roll your own, 
use the one from the [real-world example](https://github.com/reactjs/redux/blob/master/examples/real-world/src/middleware/api.js) or a 3rd party 
like [agraboso's redux-api-middleware](https://github.com/agraboso/redux-api-middleware). I use the latter - you should give it a try. It is great.

This library provides a function you can plug into your API call. If the API call returns a 401 response then your access 
token probably expired. This library will try to refresh the token. Whilst refreshing it will queue up all API calls. If the 
refresh was successful it will retry all the queued calls. If it was not successful it will log out the user.

## Prerequisites

Your API middleware must return FSA-style responses. There is a great description about [flux-standard-actions here](https://github.com/acdlite/flux-standard-action). 
You want the quick run down? Your middleware must return actions like this.

**Successful response (status range 200-299)**
```javascript
{
    type: "ACTION",
    payload: {
        // API response
    }
}
```

**Error response (everything else)**
```javascript
{
    type: "ACTION",
    error: true,
    payload: {
        status: 401 // Http status code
    }
}
```

This is the most important thing. redux-refresh-token will look for the `error` property and will look for the `status` to determine whether 
or not it should try a refresh. It will always attempt a refresh on `401` status codes. Everything else will just be ignored.

## Installation

You will need to install a reducer under the key `tokenRefresh`. If you want to change the key 
you have to pass the `refreshReducerKey` setting to `attemptRefresh`.

```javascript
import { reducer } from 'redux-refresh-token'

const store = createStore(
  combineReducers({
    tokenRefresh: refreshReducer,
    // Other reducers
  }),
  {},
  applyMiddleware(api)
)
```

So you probably have some API middlware in your code that ends a long the lines of this below

```javascript
return fetch(`${API_ROOT}${endpoint}${querystring}`, {
  method,
  body,
  headers,
  credentials: "same-origin"
})
.then(response => response.json().then(json => {
  if (!response.ok) {
    return Promise.reject(json)
  }

  return json
}))
.then(response => next({
  type: successType,
  payload: response
})), 
error => next({
  type: failureType,
  error: true,
  payload: {
    status: response.status,
    error: error.message
  }
}))
```

Now replace it with

```javascript
import attemptRefresh, { createFSAConverter } from "redux-refresh-token";

// Middleware code skipped for breweity

return fetch(`${API_ROOT}${endpoint}${querystring}`, {
  method,
  body,
  headers,
  credentials: "same-origin"
})
// This step will convert fetch's response into a FSA style action
// This is needed in the attempt method
.then(createFSAConverter(successType, failureType))
.then(
  attemptRefresh({
      // An action creator that determines what happens when the refresh failed
      failure: logout,
      // An action creator that creates an API request to refresh the token
      refreshActionCreator: attemptTokenRefresh,
      // This is the current access token. If the user is not authenticated yet 
      // this can be null or undefined
      token,

      // The next 3 parameters are simply the arguments of 
      // the middleware function
      action,
      next,
      store,
  })
)
```

## API

The `attemptRefresh` has various parameters to adjust to different types of API middleware.

### failure **required** (action creator)

Should be an actionCreator. This action will be dispatched whenever the refresh failed. 
Usually this would be a logout action.

An example could be

```javascript
export const LOGOUT_REQUEST = 'LOGOUT_REQUEST'
export const LOGOUT_SUCCESS = 'LOGOUT_SUCCESS'
export const LOGOUT_FAILURE = 'LOGOUT_FAILURE'

export const logout = () => ({
  [CALL_API]: {
    endpoint: '/logout',
    method: 'POST',
    types: [
      LOGOUT_REQUEST,
      LOGOUT_SUCCESS,
      LOGOUT_FAILURE
    ]
  }
})
```

### isRefreshCall (function(action, refreshAction))

When refreshing it is important to determine whether or not a failed action is an attempt 
to refresh the access token. Because the library will attempt to refresh all 401's, if the 
refresh call returns 401 and we do not check if successfully we are stuck in an infinite loop.

The default behaviour is to check like below

```
return action["Call API"].endpoint === refreshAction["Call API"].endpoint;
```

### refreshActionCreator **required** (action creator)

An action creator that creates the action that will request the API for a new token.

Example 

```javascript
export const TOKEN_REFRESH_REQUEST = 'TOKEN_REFRESH_REQUEST'
export const TOKEN_REFRESH_SUCCESS = 'TOKEN_REFRESH_SUCCESS'
export const TOKEN_REFRESH_FAILURE = 'TOKEN_REFRESH_FAILURE'

export const attemptTokenRefresh = () => ({
  [CALL_API]: {
    endpoint: '/login/refresh',
    method: 'POST',
    types: [
      TOKEN_REFRESH_REQUEST,
      TOKEN_REFRESH_SUCCESS,
      TOKEN_REFRESH_FAILURE
    ]
  }
})
```

### refreshReducerKey (string)

By default the reducer should be installed under the key `tokenRefresh` but you can 
change the default setting using this key.

### setAccessTokenActionCreator (action creator)

An action creator used to set a new access token in the redux store state.

The default creator is given below

```javascript
export const SET_ACCESS_TOKEN = 'SET_ACCESS_TOKEN'

export const setAccessToken = ({ access_token, expires_in }) => ({
  type: SET_ACCESS_TOKEN,
  access_token,
  expires_in
})
```

### token **Required** (string)

The current access token from the redux store state.

## Tests

```
npm test
```

## License

The MIT License (MIT). Please see [License File](https://github.com/esbenp/redux-refresh-token/blob/master/LICENSE) for more information.

