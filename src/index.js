import ReactDOM from 'react-dom'
import React from 'react'
import App from './components/App/App'

console.log('[INFO] entry point')
console.log(App, document.getElementById('root'))

ReactDOM.render(<App/>, document.getElementById('root'));