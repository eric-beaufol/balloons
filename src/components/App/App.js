import React from 'react'
import { hot } from 'react-hot-loader/root'
import Home from '../Home/Home.js'
import styles from './App.css'

class App extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <Home />
    )
  }
}

export default hot(App)