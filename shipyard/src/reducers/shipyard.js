import {
  SET_DATA,
  RESET_DATA,
  CHANGE_CHECK_STATUS,
  CHANGE_TYPE_STATUS,
  UPDATE_ATTRIBUTE,
  UPDATE_FILTERED_DATA,
  TOGGLE_SETTINGS_VISIBLE,
  SET_ATTRIBUTES,
  SET_ATTRIBUTE_COLOR,
  TOGGLE_COLOR_VISIBLE,
  SET_ALIAS,
} from './../actions/index';

const initialState = {
  data: [],
  attributes: [],
  exportData: [],
  source: [],
  updated: false,
  datasets: [
    {
      id: 1,
      title: 'Followers of presidential candidates Colombia 2018',
      description: 'Dataset with information about followers on twitter of the presidential cadidates.',
      name: 'all_followers_id.csv',
      size: 1048575,
      n_attributes: 10,
    },
    {
      id: 2,
      title: 'MoMA Collection',
      description: 'Evolving collection contains almost 130,000 works of modern and contemporary art.',
      name: 'Artworks_less_columns.csv',
      size: 131585,
      n_attributes: 14,
    },
    {
      id: 3,
      title: 'VAST Challenge 2017',
      description: 'The VAST Challenge 2017 offered three mini-challenges and a grand challenge dealing with environmental problems potentially caused by human patterns of life and potentially harmful chemically laden effluent plumes being emitted from factory smokestacks. The data provided included traffic patterns, sensor data though the Boonsong Lekagul Nature Preserve.',
      name: 'Lekagul Sensor Data.csv',
      size: 171477,
      n_attributes: 4,
    },
  ],
};
const shipyard = (state = initialState, action) => {
  switch (action.type) {
    case SET_DATA:
      return Object.assign({}, state, {
        source: action.source,
        data: action.data,
        attributes: action.attributes,
        exportData: action.source,
      });
    case RESET_DATA:
      return initialState;
    case CHANGE_CHECK_STATUS:
    let attrs = state.attributes.slice(0);
    const pos = attrs.map(e => e.name).indexOf(action.attribute.name);
    attrs[pos].checked = action.status;
    return Object.assign({}, state, {
      attributes: attrs,
    });
    case CHANGE_TYPE_STATUS:
      let attrs2 = state.attributes;
      const pos2 = attrs2.map(e => e.name).indexOf(action.attribute.name);
      attrs2[pos2].type = action.status;

      //reemplazar la columna del valor cambiado
      let original = [...state.source];
      let sourceData = state.source.slice();
      console.log('source',sourceData);
      console.log('action.status',action.status);
      //verificar que no se modifique source!!!
      switch(action.status) {
        case 'date':
          sourceData.forEach(datum=> {
            datum[action.attribute.name] = new Date(datum[action.attribute.name]);
          });
          break;
        case 'sequential':
          sourceData.forEach(datum=> {
            datum[action.attribute.name] = +datum[action.attribute.name];
          });
          break;
        default:
          console.log('default case')
          sourceData.forEach(datum=> {
            datum[action.attribute.name] = datum[action.attribute.name];
          });
          break;
      }
      let actualData = state.data.slice();
      actualData.forEach((d,i)=> {
        d[action.attribute.name] = sourceData[i][action.attribute.name];
      })
      return Object.assign({}, state, {
        attributes: attrs2,
        //checkar si funciona cambiar data -> state.source
        data: actualData,
      })
    case UPDATE_ATTRIBUTE:
      return Object.assign({}, state, {
        updated: !state.updated,
      });
    case UPDATE_FILTERED_DATA:
      return Object.assign({}, state, {
        exportData: action.exportData,
      });
    case TOGGLE_SETTINGS_VISIBLE:
      let items = state.attributes.slice(0);
      items[action.index]["settings"] = action.visible;
      console.log(items)
      return Object.assign({}, state, {
        attributes: items,
      });
    case SET_ATTRIBUTES:
      return Object.assign({}, state, {
        attributes: action.attributes,
      });
    case SET_ATTRIBUTE_COLOR:
      let attributesColor = [...state.attributes];
      let att = attributesColor.forEach(d=> {
        if(d.name == action.attributeName) {
          d["color"] = action.color;
        }
      });
      return Object.assign({}, state, {
        attributes: attributesColor,
      });
    case SET_ALIAS:
      console.log('SET_ALIAS:\n',action)
      return state;
    case TOGGLE_COLOR_VISIBLE:
      return state;
    default:
      return state;
  }
};

export default shipyard;
