import './style.css'
import { BallPark } from './ballPark'
import { Button, InfoSlider, PushButton, RadioButton, SwitchButton, tooltip } from './ui'
import { createPanels } from './panels'

Button.initialize(10, 10, 10)

const ballPark = new BallPark()

// const holdButton = new SwitchButton('hold', true);
// holdButton.onPush(() => ballPark.setHold(holdButton.on));

// const bamButton = new PushButton('bam', true);
// bamButton.onPush( async () => ballPark.bam());

const operationButtons = new RadioButton(
  [
    { name: 'add', func: (on) => ballPark.addVertex(on) },
    { name: 'flip', func: (on) => ballPark.flipEdges(on) },
    { name: 'collapse', func: (on) => ballPark.collapseEdges(on) },
  ],
  true
)
operationButtons.click(0) // activate 'add' button

const forceSlider = new InfoSlider(-1, 9, 1, 1, 'force: ', 0, '', 140, document.body)
forceSlider.onSlide(() => {
  let v = forceSlider.value
  if (v < 0) v = -0.2
  ballPark.setRepulsion(v)
  if (v !== 0) forceSlider.addClass('alert')
  else forceSlider.removeClass('alert')
})
forceSlider.setId('forceSlider')
tooltip(
  forceSlider.element,
  '30px',
  '-180px',
  '310px',
  'Controls the amount of repulsive (positive) or attractive (negative) force between the vertices similar to electrostatics. Only for zero force it is possible to find configurations where all edge lengths are equal (maximum distance error vanishes). The value can also be controlled with the left/right arrow keys.'
)

// slightly attractive force if 'a' key is pressed
document.addEventListener('keydown', (e) => {
  const v = forceSlider.value
  if (e.key === 'ArrowLeft') forceSlider.setSlider(v > -1 ? v - 1 : -1)
  if (e.key === 'ArrowRight') forceSlider.setSlider(v < 9 ? v + 1 : 9)
  ballPark.action = true
})

const subdivideButton = new PushButton('subdivide')
subdivideButton.onPush(() => {
  // if(confirm('Are you sure you want to subdivide?'))
  ballPark.startSubdivide(true)
})
subdivideButton.button.id = 'subdivideBut'
document.body.appendChild(subdivideButton.button)
tooltip(
  subdivideButton.button,
  '30px',
  '-130px',
  '220px',
  'Adds a new vertex on every edge and creates all new necessary edges, quadrupling the number of faces.'
)

// init____________________________________________________

await ballPark.initialize()

forceSlider.setSlider(forceSlider.value)

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
