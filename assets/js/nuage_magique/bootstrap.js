// bootstrap.js
import { FontLoader } from './FontLoader.js';
import { TextGeometry } from './TextGeometry.js';
import * as THREE from './three.module.js';

// Fusion manuelle, on n’injecte rien sur THREE (qui est read-only)
const THREE_X = {
  ...THREE,
  FontLoader,
  TextGeometry
};

export default THREE_X;
