import React, { Component } from 'react';
// import Navio from '@jg.murillo10/test-npm';
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
const showStyle = { visibility: 'visible', overflowX: 'scroll', overflowY: 'scroll' };
const mainStyle = { visibility: 'hidden', display: 'none', transition: 'all 0.5s ease' };
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
            if (d.checked) {
        if (d.type === cat) {
          this.nn.addCategoricalAttrib(d.name);
        } else if (d.type === seq) {
          if (d.data === 'date') {
            this.nn.addSequentialAttrib(d.name,
              d3.scaleLinear()
                // .domain(d.min, d.max)
                .range([d3_chromatic.interpolatePurples(0), d3_chromatic.interpolatePurples(1)]))
          }
          else {
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
