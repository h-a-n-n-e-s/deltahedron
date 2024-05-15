import './style.css';
import { BallPark } from "./ballPark";
import { Button, InfoSlider, SwitchButton } from './button-slider';

Button.initialize(10, 10, 10);

const ballPark = new BallPark();

const gravitySlider = new InfoSlider(0, 10, 1, 1, 'repulsion: ', 0, '', 200, document.body);
gravitySlider.onSlide(() => ballPark.setGravity(gravitySlider.value));
gravitySlider.setId('gravitySlider');

await ballPark.initialize();
ballPark.setGravity(gravitySlider.value);

const holdButton = new SwitchButton('hold', true);
holdButton.onPush(() => ballPark.setHold(holdButton.on));

const rotateButton = new SwitchButton('rotate', true);
rotateButton.onPush(() => ballPark.setRotation(rotateButton.on));