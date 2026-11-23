/* eslint-env mocha */
/* global expect, it */

import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'
import Accessible from './Accessible'

// renders into a detached container and returns the rendered DOM node
// (replaces enzyme's mount, which has no React 18 adapter)
const mount = (element) => {
  const div = document.createElement('div')
  act(() => {
    ReactDOM.render(element, div)
  })
  return div.firstChild
}

it('renders without crashing', () => {
  const div = document.createElement('div')
  ReactDOM.render(<Accessible><div /></Accessible>, div)
})

it('crashes if multiple children are passed', (done) => {
  const div = document.createElement('div')
  try {
    ReactDOM.render(
      <Accessible>
        <div />
        <div />
      </Accessible>,
      div
    )
  } catch (e) {
    return done()
  }
  throw new Error('Accessible should have crashed')
})

it('adds aria-* attributes to child component', () => {
  const el = mount(<Accessible label='Test' expanded><div /></Accessible>)
  expect(el.getAttribute('aria-label')).toEqual('Test')
  expect(el.getAttribute('aria-expanded')).toEqual('true')
})

it('adds space and enter handlers and allows original action', () => {
  let count = 0
  const onClick = () => count++
  const el = mount(
    <Accessible label='Test' action={onClick}>
      <a onClick={onClick}>Click Me</a>
    </Accessible>
  )

  Simulate.keyDown(el, { keyCode: 13 })
  expect(count).toEqual(1)

  Simulate.keyDown(el, { keyCode: 32 })
  expect(count).toEqual(2)

  Simulate.click(el)
  expect(count).toEqual(3)
})

it('will infer action if none specified', () => {
  let count = 0
  const onClick = () => count++
  const el = mount(
    <Accessible label='Test'>
      <a onClick={onClick}>Click Me</a>
    </Accessible>
  )

  Simulate.keyDown(el, { keyCode: 13 })
  expect(count).toEqual(1)
})

it('adds tabIndex to interactive components', () => {
  let count = 0
  const onClick = () => count++
  const el = mount(
    <Accessible label='Test' action={onClick}>
      <a onClick={onClick}>Click Me</a>
    </Accessible>
  )
  expect(el.getAttribute('tabindex')).toEqual('0')
})
