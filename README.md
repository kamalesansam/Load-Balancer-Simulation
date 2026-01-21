# Load Balancer Simulation: Graphical Virtualization

This project provides a comprehensive graphical virtualization and animation of network load balancing algorithms. It is built with Next.js to demonstrate how distributed systems manage incoming traffic and maintain high availability through various distribution strategies.

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:
```bash
npm run dev
```

## Core Simulations
The platform virtualizes several industry-standard algorithms:

Round Robin: Sequentially distributes requests across the server pool.

Least Connections: Dynamically routes traffic to the server with the fewest active sessions.

Weighted Round Robin: Assigns traffic based on pre-defined server capacity.

IP Hashing: Ensures session persistence by mapping client IP addresses to specific servers.

## Technical Features
Graphical Virtualization: Real-time visual representation of request packets moving through the network stack.

Dynamic Animation: Visual feedback on server health, traffic spikes, and redistribution logic.

Performance Metrics: Live data visualization showing requests per second (RPS) and server utilization.

Learn More
To learn more about the technologies used in this project:

Next.js Documentation - Learn about Next.js features and API.

Load Balancing Theory - Overview of traffic distribution.

Deploy on Vercel
The easiest way to deploy your simulation is to use the Vercel Platform.

Check out our Next.js deployment documentation for more details.
