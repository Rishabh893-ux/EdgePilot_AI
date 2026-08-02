"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function Motor({ temperature, vibration }: { temperature: number; vibration: number }) {
  const meshRef = useRef<THREE.Group>(null!);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Base rotation
      meshRef.current.rotation.y += delta;
      
      // Vibration effect (shake randomly if vibration > 2.0)
      if (vibration > 2.0) {
        const shake = (vibration - 2.0) * 0.05;
        meshRef.current.position.x = (Math.random() - 0.5) * shake;
        meshRef.current.position.y = (Math.random() - 0.5) * shake;
        meshRef.current.position.z = (Math.random() - 0.5) * shake;
      } else {
        meshRef.current.position.set(0, 0, 0);
      }
    }
  });

  // Calculate color based on temperature (normal ~65C, high > 75C)
  const isHighTemp = temperature > 75;
  const color = isHighTemp ? "#ef4444" : "#3b82f6"; // Red if hot, blue if normal

  return (
    <group ref={meshRef}>
      {/* Motor Body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1, 1, 3, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Shaft */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Base */}
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[2.5, 0.2, 2.5]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </group>
  );
}

export default function MachineDigitalTwin({ temperature, vibration }: { temperature: number; vibration: number }) {
  return (
    <div className="w-full h-full min-h-[300px] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 flex flex-col items-center justify-center relative">
      <div className="absolute top-2 left-3 z-10 text-xs font-semibold text-slate-300 uppercase tracking-widest pointer-events-none">
        Digital Twin
      </div>
      <Canvas camera={{ position: [0, 3, 7], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />
        
        <Motor temperature={temperature} vibration={vibration} />
        <OrbitControls enableZoom={true} autoRotate={false} />
      </Canvas>
    </div>
  );
}
