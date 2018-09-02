import React, { Component } from 'react';
import { Select, Button } from 'antd';
import { connect } from 'react-redux';
import * as d3 from 'd3';
import './sortableItem.css';
import { setColor, updateAttribute } from './../../../../actions';

const Option = Select.Option;

class ColorPicker extends Component {
  componentDidUpdate(){
    console.log('COLOR componentDidUpdate')
  }
  componentWillUpdate(){

    console.log('COLOR componentWillUpdate')
  }
  render(){
    let { setColor, name } = this.props;
    if (this.props.type == 'categorical') {
      return Categorical();
    }
    else {
      console.log('this.props',this.props)
      return SequentialPicker(setColor, name);
    }
  }
}

const Categorical = () => {
  const cat10 = d3.scaleOrdinal(d3.schemeCategory10);
  const cat20 = d3.scaleOrdinal(d3.schemeCategory20);
  const cat20b = d3.scaleOrdinal(d3.schemeCategory20b);
  const cat20c = d3.scaleOrdinal(d3.schemeCategory20c);
  const arr10 = d3.range(10);
  const arr20 = d3.range(20);
  return (
    <Select size="small" defaultValue="scheme10" className="color-selector">
        <Option value="scheme10">
          <div className="scheme10">
            {
              arr10.map((d,i) => (
                <div key={i+'10'} style={{ width: 20, height: 20, backgroundColor: cat10(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
        <Option value="scheme20">
          <div className="scheme20">
            {
              arr20.map(d => (
                <div style={{ width: 10, height: 20, backgroundColor: cat20(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
        <Option value="scheme20b">
          <div className="scheme20">
            {
              arr20.map(d => (
                <div style={{ width: 10, height: 20, backgroundColor: cat20b(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
        <Option value="scheme20c">
          <div className="scheme20">
            {
              arr20.map(d => (
                <div style={{ width: 10, height: 20, backgroundColor: cat20c(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
      </Select>
  );
};

class CategoricalPicker extends Component {
  render () {
    var cat10 = d3.scaleOrdinal(d3.schemeCategory10);
    var cat20 = d3.scaleOrdinal(d3.schemeCategory20);
    var cat20b = d3.scaleOrdinal(d3.schemeCategory20b);
    var cat20c = d3.scaleOrdinal(d3.schemeCategory20c);
    let arr10 = d3.range(10);
    let arr20 = d3.range(20);
    return (
      <Select size="small" defaultValue="scheme10" className="color-selector">
        <Option value="scheme10">
          <div className="scheme10">
            {
              arr10.map(d => (
                <div style={{ width: 20, height: 20, backgroundColor: cat10(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
        <Option value="scheme20">
          <div className="scheme20">
            {
              arr20.map(d => (
                <div style={{ width: 10, height: 20, backgroundColor: cat20(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
        <Option value="scheme20b">
          <div className="scheme20">
            {
              arr20.map(d => (
                <div style={{ width: 10, height: 20, backgroundColor: cat20b(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
        <Option value="scheme20c">
          <div className="scheme20">
            {
              arr20.map(d => (
                <div style={{ width: 10, height: 20, backgroundColor: cat20c(d)}}>
                </div>
              ))
            }
          </div>
        </Option>
      </Select>
    )
  }

}

const colors = ["blue", "green", "gray", "orange","purple", "red"];
  

const SequentialPicker = (setColor, name) => {
  console.log(setColor)
  return (
    <div className="sequential-picker">
      { colors.map(d=> (
        <Button key={d} onClick={(click) => setColor(d, name)} shape="circle" style={{ backgroundColor: d }}></Button> 
        ))
      }
    </div>
    
  );
}

const mapStateToProps = (state, ownProps) => ({
  type: ownProps.type,
  name: ownProps.name,
});

const mapDispatchToProps = dispatch => ({
  setColor: (d, click) => {dispatch(setColor(d, click)); dispatch(updateAttribute());},
})

export default connect(mapStateToProps, mapDispatchToProps)(ColorPicker);