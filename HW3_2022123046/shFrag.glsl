#version 300 es
precision highp float;

out vec4 outColor;
uniform vec4 u_color;
uniform int u_drawCircle;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_thickness;

void main() {
    if (u_drawCircle == 1) {
        vec2 ndc;
        ndc.x = (gl_FragCoord.x / u_resolution.x) * 2.0 - 1.0;
        ndc.y = (gl_FragCoord.y / u_resolution.y) * 2.0 - 1.0;
        float dist = distance(ndc, u_center);
        if(abs(dist - u_radius) < u_thickness) {
            outColor = u_color;
        }
        else {
            discard;
        }
    }
    else{
        outColor = u_color;
    }
} 