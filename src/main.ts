import './style.css'
import { BallPark } from './ballPark'
import { Button, InfoSlider, PushButton, RadioButton, SwitchButton } from './ui'
import { createPanels } from './panels'

Button.initialize(10, 10, 10)

const ballPark = new BallPark()

// const holdButton = new SwitchButton('hold', true);
// holdButton.onPush(() => ballPark.setHold(holdButton.on));

const rotateButton = new SwitchButton('rotate', true)
rotateButton.onPush(() => ballPark.setRotation(rotateButton.on))

const faceButton = new SwitchButton('faces', true)
faceButton.onPush(() => ballPark.showFaces(faceButton.on))

const rodButton = new SwitchButton('rods', true)
rodButton.onPush(() => ballPark.showRods(rodButton.on))

const ballButton = new SwitchButton('balls', true)
ballButton.onPush(() => ballPark.showBalls(ballButton.on))

const showOnlyIsoRodsButton = new SwitchButton('iso rods', true)
showOnlyIsoRodsButton.onPush(() => ballPark.setShowOnlyIsoRods(showOnlyIsoRodsButton.on))

const subdivideButton = new PushButton('subdivide', true)
subdivideButton.onPush(() => {
  // if(confirm('Are you sure you want to subdivide?'))
  ballPark.startSubdivide(true)
})

// const bamButton = new PushButton('bam', true);
// bamButton.onPush( async () => ballPark.bam());

const repulsionSlider = new InfoSlider(0, 9, 1, 1, 'repulsion: ', 0, '', 140, document.body)
repulsionSlider.onSlide(() => {
  const v = repulsionSlider.value
  ballPark.setRepulsion(v)
  if (v !== 0) repulsionSlider.addClass('alert')
  else repulsionSlider.removeClass('alert')
})
repulsionSlider.setId('repulsionSlider')

// slightly attractive force if 'a' key is pressed
document.addEventListener('keydown', (e) => {
  if (e.key === 'a') ballPark.setRepulsion(-0.2)
})
document.addEventListener('keyup', (e) => {
  if (e.key === 'a') ballPark.setRepulsion(repulsionSlider.value)
})

const operationButtons = new RadioButton(
  [
    { name: 'add', func: (on) => ballPark.addVertex(on) },
    { name: 'flip', func: (on) => ballPark.flipEdges(on) },
    { name: 'collapse', func: (on) => ballPark.collapseEdges(on) },
  ],
  false
)
operationButtons.click(0) // activate 'add' button

await ballPark.initialize()

// show stuff
faceButton.click()
rodButton.click()
ballButton.click()

repulsionSlider.setSlider(repulsionSlider.value)

// logo
const a = document.createElement('a')
a.href = 'https://formaldesign.net'
a.target = '_blank'
document.body.appendChild(a)
const img = document.createElement('img')
img.id = 'logo'
img.src = '/FD_anime2.svg'
a.appendChild(img)

const allowTetrahedraButton = new SwitchButton(' ')
allowTetrahedraButton.onPush(() => ballPark.setAllowTetrahedra(allowTetrahedraButton.on))
allowTetrahedraButton.button.id = 'allowTetrahedra'
document.body.appendChild(allowTetrahedraButton.button)

// panels _________________________________________________

createPanels(ballPark)
