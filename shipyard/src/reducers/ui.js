import { SHOW_MODAL, TOGGLE_LOADING, TOGGLE_DATA_LOADED, RESET_DATA, TOGGLE_SIDEBAR } from './../actions/index';

const initialState = {
  confirmLoading: false,
  closed: true,
  loading: false,
  visible: false,
  dataLoaded: false,
  showSidebar: false,
};
const ui = (state = initialState, action) => {
  switch (action.type) {
    case SHOW_MODAL:
      return Object.assign({}, state, {
        visible: !state.visible,
      });
    case TOGGLE_LOADING:
      return Object.assign({}, state, {
        loading: !state.loading,
      });
    case TOGGLE_DATA_LOADED:
      return Object.assign({}, state, {
        dataLoaded: !state.dataLoaded,
      });
    case RESET_DATA:
      return initialState;
    case TOGGLE_SIDEBAR:
      return Object.assign({}, state, {
        showSidebar: !state.showSidebar,
      })
    default:
      return state;
  }
};

export default ui;
