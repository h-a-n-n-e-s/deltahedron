# Deltahedron

A 3D interactive application for exploring deltahedra&mdash;polyhedra composed entirely of equilateral triangles. Unlike systems that form complex shapes by combining simpler ones, this application takes a more organic approach using three edge operations. For any given edge, one can either add a vertex on it, flip it, or remove it. The algorithm continuously seeks a configuration where all edges maintain unit length. Although these operations may seem unconventional at first, they can produce intriguing structures that are difficult to obtain through other methods.

The app is online at [https://delta.formaldesign.net](https://delta.formaldesign.net).

<img src='public/app_screenshot.jpg' alt= 'delta app'>

## WebGPU

This project does not use any dependencies and was almost completely written from scratch using [WebGPU](https://www.w3.org/TR/webgpu/) for rendering and compute shaders. Many thanks to [webgpufundamentals.org](https://webgpufundamentals.org), [WebGPU samples](https://webgpu.github.io/webgpu-samples), [toji.dev](https://toji.dev), and also to [learnopengl.com](https://learnopengl.com) for great tutorials about lighting!✨
