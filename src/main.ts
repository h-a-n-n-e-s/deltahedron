import './style.css'
import { BallPark } from './ballPark'
import { Button, InfoSlider, PushButton, RadioButton } from './ui'
import { checkBrowserSupport, createOverlay, tooltip } from './display'
import { createPanels } from './panels'

const validBrowser = await checkBrowserSupport()

const loadingTexturesOverlay = validBrowser
  ? createOverlay('loading textures...', 'loadTexOverlay')
  : undefined
if (loadingTexturesOverlay) loadingTexturesOverlay.style.display = 'flex'

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
tooltip(
  operationButtons.button(0).button,
  0,
  -30,
  200,
  'Adds a new vertex on the selected edge and creates all new necessary edges.'
)
tooltip(
  operationButtons.button(1).button,
  0,
  -30,
  200,
  'Flips the selected edge to connect the vertices which were not connected in the two triangles next to the edge.'
)
tooltip(
  operationButtons.button(2).button,
  0,
  -30,
  210,
  'Collapses the selected edge and merges the corresponding vertices and edges.'
)
operationButtons.click(0) // activate 'add' button

const min = -2
const max = 8
const forceSlider = new InfoSlider(min, max, 1, 1, 'force: ', 0, '', 140, document.body)
forceSlider.onSlide(() => {
  let v = forceSlider.value
  if (v < 0) v = 0.2 * forceSlider.value
  ballPark.setRepulsion(v)
  if (v !== 0) forceSlider.addClass('alert')
  else forceSlider.removeClass('alert')
})
forceSlider.setId('forceSlider')
tooltip(
  forceSlider.element,
  0,
  -30,
  310,
  'Controls the amount of repulsive (positive) or attractive (negative) force between the vertices similar to electrostatics. Only for zero force it is possible to find configurations where all edge lengths are equal (maximum distance error vanishes). The force value can also be controlled with the left/right arrow keys.'
)
// slightly attractive force if 'a' key is pressed
document.addEventListener('keydown', (e) => {
  const v = forceSlider.value
  if (e.key === 'ArrowLeft') forceSlider.setSlider(v > min ? v - 1 : min)
  if (e.key === 'ArrowRight') forceSlider.setSlider(v < max ? v + 1 : max)
  ballPark.action = true
})
// focused listener to prevent "double stepping"
const sliderInput = forceSlider.element.querySelector('input')
sliderInput?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation() // prevents document listener from seeing this event
  }
})

const subdivideButton = new PushButton('subdivide')
subdivideButton.onPush(() => {
  // if(confirm('Are you sure you want to subdivide?'))
  // make sure there is some repulsion before subdividing
  if (forceSlider.value <= 0) forceSlider.setSlider(1)
  ballPark.startSubdivide(true)
})
subdivideButton.button.id = 'subdivideBut'
document.body.appendChild(subdivideButton.button)
tooltip(
  subdivideButton.button,
  0,
  -30,
  220,
  'Adds a new vertex on every edge and creates all new necessary edges, quadrupling the number of faces.'
)

// init____________________________________________________

// global overlay for preventing user input,
// for example, during subdivide
const subdivideOverlay = createOverlay('subdividing...')

// main routine
await ballPark.initialize(subdivideOverlay)

forceSlider.setSlider(forceSlider.value)

if (loadingTexturesOverlay) loadingTexturesOverlay.remove()

// logo
const a = document.createElement('a')
a.href = 'https://formaldesign.net'
a.target = '_blank'
document.body.appendChild(a)
const img = document.createElement('img')
img.id = 'logo'
img.src = '/FD_anime2.svg'
a.appendChild(img)

// panels _________________________________________________

createPanels(ballPark)
