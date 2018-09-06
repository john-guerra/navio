/*
 *  action types
 */

export const SET_DATA = 'SET_DATA';
export const SET_ATTRIBUTES = 'SET_ATTRIBUTES';
export const SET_ATTRIBUTE_COLOR = 'SET_ATTRIBUTE_COLOR';
export const SHOW_MODAL = 'SHOW_MODAL';
export const HANDLE_OK = 'HANDLE_OK';
export const HANDLE_CANCEL = 'HANDLE_CANCEL';
export const TOGGLE_LOADING = 'TOGGLE_LOADING';
export const TOGGLE_DATA_LOADED = 'TOGGLE_DATA_LOADED';
export const TOGGLE_SIDEBAR = 'TOGGLE_SIDEBAR';
export const RESET_DATA = 'RESET_DATA';
export const CHANGE_CHECK_STATUS = 'CHANGE_CHECK_STATUS';
export const CHANGE_TYPE_STATUS = 'CHANGE_TYPE_STATUS';
export const UPDATE_ATTRIBUTE = 'UPDATE_ATTRIBUTE';
export const UPDATE_FILTERED_DATA = 'UPDATE_FILTERED_DATA';
export const TOGGLE_SETTINGS_VISIBLE = 'TOGGLE_SETTINGS_VISIBLE';
export const TOGGLE_COLOR_VISIBLE = 'TOGGLE_COLOR_VISIBLE';
export const DELETE_COMPONENT_CLASS = 'DELETE_COMPONENT_CLASS';
export const ADD_COMPONENT_CLASS = 'ADD_COMPONENT_CLASS';
export const SET_COMPONENT_CLASSES = 'SET_COMPONENT_CLASSES';
export const SWAP_COMPONENT_CLASSES = 'SWAP_COMPONENT_CLASSES';
export const SET_ALIAS = 'SET_ALIAS';

/**
 * Method that return true if a string is a date
 * @param {*} attr
 */
const checkDate = (attr) => {
  const mydate = new Date(attr);
  if (isNaN(mydate.getDate())) {
    return false;
  }
  return true;
};

/*
 * complementary functions
 */
const getAttributesType = (keys, atts, data) => {
  let attributes = JSON.parse(JSON.stringify(atts));
  console.log('COPY ATTRIBUTES', attributes);
  let ids = [];
  // regular expression used to match strings starting and finishing with id or key or in a word within non-word characters
  const reg = /^(id|key)|(id|key)$|\W+\_*(key|id)+\_*\W+|\W+\_*(key|id)+\_*\W*/gmi;
  // categorical, ordinal, sequential, date
  const seq = 'SEQUENTIAL';
  const cat = 'CATEGORICAL';
  const ord = 'ORDINAL';
  const dat = 'DATE';

  for (let key = 0; key < keys.length; key += 1) {
    const attr = data[1][keys[key]];
    if (reg.test(attributes[key].name)) {
      attributes[key].id = true;
      ids.push(atts[key].name);
    }
    const notNumber = isNaN(attr);
    const isDate = checkDate(attr);
    if (!notNumber) {
      attributes[key].type = seq;
      attributes[key].data = 'number';

      let min = data[0][keys[key]];
      let max = data[0][keys[key]];
      for (let i = 0; i < data.length; i += 1) {
        if (data[i][keys[key]] > max) {
          max = data[i][keys[key]];
        } if (data[i][keys[key]] < min) {
          min = data[i][keys[key]];
        }
      }
      attributes[key].min = min;
      attributes[key].max = max;
    } else if (isDate) {
      attributes[key].type = seq;
      attributes[key].data = 'date';

      let min = data[0][keys[key]];
      let max = data[0][keys[key]];
      for (let j = 0; j < data.length; j += 1) {
        if (data[j][keys[key]] > max) {
          max = data[j][keys[key]];
        } if (data[j][keys[key]] < min) {
          min = data[j][keys[key]];
        }
      }
    } else {
      attributes[key].type = cat;
      attributes[key].data = 'string';
    }
  }
  return [attributes, ids];
};

/*
 * action creators
 */
export const setData = (data) => {
  const source = data.slice(0);
  /* Creates an empty array that will contain the metadata of the attributes */
  let attributes = [];
  let ids = [];
  const keys = Object.keys(data[0]);
  for (let i = 0; i < keys.length; i += 1) {
    const attribute = {
      name: keys[i],
      alias: keys[i],
      checked: true,
      type: '',
      id: false,
      settings: false,
    };
    attributes.push(attribute);
  }
  [attributes, ids] = getAttributesType(keys, attributes, data);
  const parsedData = data.map((d) => {
    let row = JSON.parse(JSON.stringify(d));
    attributes.forEach((att)=> {
      if (att.data === 'date') {
        const mydate = new Date(row[att.name]);
        if (isNaN(mydate.getDate())) {
          // row[att.name] = null;
        } else {
          row[att.name] = mydate;
        }
      } else if (att.data === 'number') {
        const mynumber = +row[att.name];
        if (isNaN(mynumber)) {
          // row[att.name] = null;
        } else {
          row[att.name] = mynumber;
        }
      }
    });
    return row;
  });
  return {
    type: SET_DATA,
    source,
    data: parsedData,
    attributes,
    ids,
  };
};
export const setComponentClasses = attributes => ({
  type: SET_COMPONENT_CLASSES,
  attributes,
});

export const setColor = (color, attributeName) => ({
  type: SET_ATTRIBUTE_COLOR,
  color,
  attributeName,
});

export const showModal = () => ({ type: SHOW_MODAL });

export const handleOk = () => {};

export const handleCancel = () => {};

export const toggleLoading = () => ({ type: TOGGLE_LOADING });

export const toggleDataLoaded = () => ({ type: TOGGLE_DATA_LOADED });

export const resetData = () => ({ type: RESET_DATA });

export const toggleSidebar = () => ({ type: TOGGLE_SIDEBAR });

export const changeCheckStatus = (attribute, status) => ({
  type: CHANGE_CHECK_STATUS,
  attribute,
  status,
});

export const changeTypeStatus = (attribute, status) => ({
  type: CHANGE_TYPE_STATUS,
  attribute,
  status,
});

export const updateAttribute = () => ({ type: UPDATE_ATTRIBUTE });

export const updateFilteredData = exportData => ({ type: UPDATE_FILTERED_DATA, exportData });

export const toggleSettingsVisible = (index, visible) => ({
  type: TOGGLE_SETTINGS_VISIBLE,
  index,
  visible,
});

export const setAttributes = attributes => ({
  type: SET_ATTRIBUTES,
  attributes,
});

export const setAttributeColor = (color, event, index) => ({
  type: SET_ATTRIBUTE_COLOR,
  color,
  event,
  index,
});

export const toggleColorVisible = index => ({
  type: TOGGLE_COLOR_VISIBLE,
  index,
});

export const deleteLastComponentClass = index => ({
  type: DELETE_COMPONENT_CLASS,
  index,
});

export const addComponentClass = (className, index) => ({
  type: ADD_COMPONENT_CLASS,
  className,
  index,
})

export const swapComponentClasses = (i, j) => ({
  type: SWAP_COMPONENT_CLASSES,
  i,
  j,
})

export const setAlias = (event, attribute) => ({
  type: SET_ALIAS,
  event,
  attribute,
});
