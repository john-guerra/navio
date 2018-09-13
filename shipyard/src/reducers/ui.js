import { SHOW_MODAL, TOGGLE_LOADING, TOGGLE_DATA_LOADED, RESET_DATA, TOGGLE_SIDEBAR, DELETE_COMPONENT_CLASS, ADD_COMPONENT_CLASS, SET_COMPONENT_CLASSES, SWAP_COMPONENT_CLASSES } from './../actions/index';

const initialState = {
  confirmLoading: false,
  closed: true,
  loading: false,
  visible: false,
  dataLoaded: false,
  showSidebar: false,
  componentClasses: ['box'],
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
      });
    case DELETE_COMPONENT_CLASS:
      let componentsDeleted = state.componentClasses.splice(0);
      componentsDeleted[action.index].classes = ["box"];
      return Object.assign({}, state, {
        componentClasses: componentsDeleted,
      });
    case ADD_COMPONENT_CLASS:
      console.log(action)
      const componentAdd = ['box', action.className];
      let componentsAdd = state.componentClasses.splice(0);
      componentsAdd[action.index].classes = componentAdd; 
      return Object.assign({}, state, {
        componentClasses: componentsAdd,
      });
    case SWAP_COMPONENT_CLASSES:
      let temp;
      let swaped = state.componentClasses.splice(0);
      temp = swaped[action.i];
      swaped[action.i] = swaped[action.j];
      swaped[action.j] = temp;
      return Object.assign({}, state, {
        componentClasses: swaped,
      });
    case SET_COMPONENT_CLASSES:
      let array = [];
      console.log(action)
      console.log(state.componentClasses)
      action.attributes.forEach((d, k)=> {
        let i = {};
        i.classes = ['box', 'hide'];
        i.index = k;
        array.push(i);
      })
      return Object.assign({}, state, {
        componentClasses: array,
      })
    default:
      return state;
  }
};

export default ui;
