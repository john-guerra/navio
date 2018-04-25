import React from 'react';
import thunkMiddleware from 'redux-thunk';
import { render } from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import { createLogger } from 'redux-logger';
import App from './components/App';
import rootReducer from './reducers';
import registerServiceWorker from './registerServiceWorker';
import './App.css';

const loggerMiddleware = createLogger();
const store = createStore(
  rootReducer,
  applyMiddleware(
    thunkMiddleware,
    loggerMiddleware,
  ),
);
render(<Provider store={store}><App /></Provider>, document.getElementById('root'));
registerServiceWorker();
