import React, { Component } from 'react';
import Navio from './Navio.js';
import { Row, Col } from 'antd';
import { connect } from 'react-redux';
import * as d3 from 'd3';
import ActionGroup from './ActionGroup';
import Side from './sidebar/Sider';
import { updateAttribute, updateFilteredData } from './../../../actions';
import './sidebar.css';

const d3_chromatic = require("d3-scale-chromatic");
const cat = 'categorical';
const seq = 'sequential';
class NavioContainer extends Component {
  componentDidMount() {
    this.setupNavio();
  }
  componentDidUpdate() {
    const { updated, updateAttribute } = this.props;
    if (updated) {
      this.deleteWidget();
      updateAttribute();
      this.setupNavio();
    }
  }
  deleteWidget = () => {
    var myNode = document.getElementById("vis");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.firstChild);
    }
  }
  setupNavio = () => {
    this.nn = new Navio(this.target, 600).updateCallback(this.props.updateFilteredData);
    for (var i = 0; i < this.props.attributes.length; i++) {
        let d = this.props.attributes[i];
        console.log(d);
        if (d.checked) {
          let color;
          switch (d.type) {
            case cat:
              switch (d.color) {
                case 'scheme10':
                  color = d3.scaleOrdinal(d3_chromatic.schemeCategory10);
                  break;
                case 'scheme20':
                  color = d3.scaleOrdinal(d3_chromatic.schemeCategory20);
                  break;
                case 'scheme20b':
                  color = d3.scaleOrdinal(d3_chromatic.schemeCategory20b);
                  break;
                case 'scheme20c':
                  color = d3.scaleOrdinal(d3_chromatic.schemeCategory20c);
                  break;
                default:
                  //scheme 10 default
                  color = d3.scaleOrdinal(d3_chromatic.schemeCategory10);
                  break;
              }
              console.log(d.name, color)
              this.nn.addCategoricalAttrib(d.name, color);
              break;
            default:
              if (d.data == 'date') {
                 switch (d.color) {
                  case 'blue':
                    color = d3.scaleTime(d3_chromatic.schemeBlues);
                    break;
                  case 'purple':
                    color = d3.scaleTime(d3_chromatic.schemePurples);
                    break;
                  case 'red':
                    color = d3.scaleTime(d3_chromatic.schemeReds);
                    break;
                  case 'green':
                    color = d3.scaleTime(d3_chromatic.schemeGreens);
                    break;
                  case 'gray':
                    color = d3.scaleTime(d3_chromatic.schemeGrays);
                    break;
                  case 'orange':
                    color = d3.scaleTime(d3_chromatic.schemeOranges);
                    break;
                  default:
                    // purple
                    color = d3.scaleLinear(d3_chromatic.schemePurples);
                    break;
                }
                console.log(d.name, color)
                this.nn.addSequentialAttrib(d.name, color);
                break;
              }
              else {
                  switch (d.color) {
                    case 'blue':
                      color = d3.scaleOrdinal(d3_chromatic.schemeBlues);
                      break;
                    case 'purple':
                      color = d3.scaleOrdinal(d3_chromatic.schemePurples);
                      break;
                    case 'red':
                      color = d3.scaleOrdinal(d3_chromatic.schemeReds);
                      break;
                    case 'green':
                      color = d3.scaleOrdinal(d3_chromatic.schemeGreens);
                      break;
                    case 'gray':
                      color = d3.scaleOrdinal(d3_chromatic.schemeGrays);
                      break;
                    case 'orange':
                      color = d3.scaleOrdinal(d3_chromatic.schemeOranges);
                      break;
                    default:
                      // purple
                      color = d3.scaleLinear(d3_chromatic.schemeOranges);
                      console.log('default', color);
                      break;
                  }
                  console.log(d.name, color)
                  this.nn.addSequentialAttrib(d.name, color);
                  break;
              }

          }
      }
    }
    this.nn.data(this.props.data);
  }
  setupNavio2 = () => {
    this.nn = new Navio(this.target, 600).updateCallback(this.props.updateFilteredData);
    for (var i = 0; i < this.props.attributes.length; i++) {
        let d = this.props.attributes[i];
            if (d.checked) {
        if (d.type === cat) {
          this.nn.addCategoricalAttrib(d.name, 
            d3.scaleOrdinal(d3.schemeCategory10));
        } else if (d.type === seq) {
          if (d.data === 'date') {
            this.nn.addSequentialAttrib(d.name,
              d3.scaleTime(d3_chromatic.schemeBlues))
                // .domain(d.min, d.max)
                // .range([d3_chromatic.interpolatePurples(0), d3_chromatic.interpolatePurples(1)]))
          }
          else {
            console.log(d3)
            console.log(d3_chromatic)
            this.nn.addSequentialAttrib(d.name) 
              // d3.scaleLinear()
              //   // .base(Math.E)
              //   .domain(d.min, d.max)
              //   .range([0,600]))
          }
        }
      }
    }
    this.nn.data(this.props.data);
  };
  render () {
    const { showSidebar } = this.props;
    const sidebarStyles = ['sidebar'];
    if (!showSidebar) {sidebarStyles.push('hide')}
    return (
      <div>
        <ActionGroup />
        <Row>
          <Col span={10} className={sidebarStyles.join(' ')}>
            <Side />
          </Col>
          <Col span={showSidebar ? 14 : 24}>
            <div
              style={{ width: '100%', overflowX: 'scroll' }}
              id="vis"
              ref={(target) => this.target = target }
            />
          </Col>
        </Row>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  showSidebar: state.ui.showSidebar,
  attributes: state.shipyard.attributes,
  data: state.shipyard.data,
  updated: state.shipyard.updated,
});

const mapDispatchToProps = dispatch => ({
  updateAttribute: () => dispatch(updateAttribute()),
  updateFilteredData: data => dispatch(updateFilteredData(data)),
})

export default connect(mapStateToProps, mapDispatchToProps)(NavioContainer);
