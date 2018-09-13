import { combineReducers } from 'redux';
import shipyard from './shipyard';
import ui from './ui';

export default combineReducers({
  shipyard,
  ui,
});
