import React, { Component } from 'react'
import Load from './../load/Load.jsx';
import { Link } from 'react-router-dom';
class Home extends Component {
  goToLoad(){
    console.log('goToLoad');
  }
  render() {
    return (
      <div>
        <div className="row">
          <div className="col-md-2">
            <div className="pull-right" >
              <img width={160} src="https://raw.githubusercontent.com/john-guerra/NodeNavigator/master/src/example.png" alt="node navigator"></img>
            </div>
          </div>
          <div className="col-md-10">
            <strong>NodeNavigator</strong> is a d3.js visualization widget to help summarizing, browsing and navigating large network visualizations.
            <p>Steps: </p>
            <ul>
              <li>
                <div>
                  1. Upload a dataset
                </div>
                <div>
                  <img src="step1.gif" alt="step one node navigator"></img>
                </div>

              </li>
              <li>2. Select the dataset ID</li>
              <li>3. Select the attributes to display</li>
              <li>4. Use the NodeNavigator</li>
            </ul>
          </div>
        </div>
        <div className="pull-center">
            <Link className="btn loadDataButton" aria-label="load data" to={'/preprocessing/load/'}>
              <div className="button-container">
                Let's get started.
              </div>
            </Link>
        </div>
      </div>
    )
  }
}


export default Home;
