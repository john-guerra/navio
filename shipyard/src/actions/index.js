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

// categorical, ordinal, sequential, date
const seq = 'SEQUENTIAL';
const cat = 'CATEGORICAL';
const ord = 'ORDINAL';
const dat = 'DATE';
const types = [
  [seq, 'NUMBER'],
  [dat, dat],
  [cat, 'STRING']
]
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

/**
 * Returns the type of attribute casting each case.
 * @param {*} attribute 
 */
const getType = (attribute) => {
  const notNumber = isNaN(attribute);
  const isDate = checkDate(attribute);
  if (!notNumber) {
    // return [seq, 'NUMBER'];
    return 0;
  } else if (isDate) {
    // return [dat, 'DATE'];
    return 1;
  } else {
    // return [cat, 'STRING'];
    return 2;
  }
}
/**
 * Function that returns n samples from array
 * @param {Integer} n - Number of samples
 * @param {Array<Object>} data - Array with data objects
 */
const getSample = (n, data) => {
  let ss = [];
  for (let i = 1; i < n + 1; i++) {
    ss.push(i);
  }
  const indexes = ss.map(d => Math.floor(data.length*(d/n))-1);
  const sample = indexes.map(d => data[d]);
  return sample;
  
}
const getAttributesType = (keys, atts, data) => {
  let attributes = JSON.parse(JSON.stringify(atts));
  let ids = [];
  // regular expression used to match strings starting and finishing with id or key or in a word within non-word characters
  const reg = /^(id|key)|(id|key)$|\W+\_*(key|id)+\_*\W+|\W+\_*(key|id)+\_*\W*/gmi;
  // returns 6 uniformly distributed rows
  const sample = getSample(6, data);
  for (let key = 0; key < keys.length; key += 1) {
    // checks for ID
    if (reg.test(attributes[key].name)) {
      attributes[key].id = true;
      ids.push(atts[key].name);
    }
    const sampleAttributes = sample.map(d => d[keys[key]]);
    const res = sampleAttributes.map(getType);
    let accumulative = [0,0,0];
    res.forEach(d => accumulative[d] += 1);
    let max = 0;
    let i = 0;
    for(let typei = 0; typei < accumulative.length; typei++) {
      if(accumulative[typei] > max) {
        max = accumulative[typei];
        i = typei;
      }
    }
    const [type, data] = types[i];
    attributes[key].type = type;
    attributes[key].data = data;
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
      if (att.data === 'DATE') {
        const mydate = new Date(row[att.name]);
        if (isNaN(mydate.getDate())) {
          // row[att.name] = null;
        } else {
          row[att.name] = mydate;
        }
      } else if (att.data === 'NUMBER') {
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
