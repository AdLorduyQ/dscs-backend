# DSCS Backend

Backend API for a real-time observability and monitoring system for Kubernetes nodes

---

## Tech Stack

* **Core:** Node.js, Express, TypeScript
* **Database:** PostgreSQL + Prisma ORM
* **Real-Time:** Socket.IO (WebSockets)
* **K8s Integration:** `@kubernetes/client-node`
* **Testing:** Jest

---

## Prerequisites
To run this project locally, you need to have installed:
1. [Node.js](https://nodejs.org/) (v18 or higher)
2. [PostgreSQL](https://www.postgresql.org/) (Local or using Docker)
3. **(Optional but recommended)** Docker Desktop with Kubernetes enabled and the `metrics-server` installed for real data ingestion.
4. **(Optional but recommended)** Prometheus for network metrics.

---

## Installation & Setup

### Clone the repository
```
git clone https://github.com/AdLorduyQ/dscs-backend.git
cd dscs-backend
```

### Install dependencies
```
npm install
```

### Environment Variables

Replace .env file in the root of the project with your PostgreSQL connection string, following the format:
```
DATABASE_URL="postgresql://user:password@localhost:5432/dscs?schema=public"
```

### Database Setup

Run the Prisma commands to create the tables and generate the TypeScript types

```
npx prisma db push
npx prisma generate
```
(Optional) Angular frontend can log in, open the database UI with npx prisma studio and create an initial user (Role: 1 for Admin).

### Start the Server

```
npm run start:dev
```
The server will start on http://localhost:3000 and the monitoring engine will automatically start reading metrics from your local cluster (~/.kube/config).

### for testing 

npm run test

### Kubernetes Integration

this backend reads live metrics using the K8s Custom API (metrics.k8s.io) and prometheus, if you don't use prometheus dummy data will be used on disk and network metrics.
If you test the project locally and see a [K8s Monitor] Error conectando a K8s... message, make sure to apply the metrics server to your local cluster:
```
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
```
check cluster running with:
```
kubectl get nodes
```

to enable prometheus integration, you need to install prometheus and configure it to scrape the metrics from the nodes.

```
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```
check all runing pods with:
```
kubectl get pods -n monitoring
```

let running in separate terminal:
```
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
```

```
kubectl port-forward svc/prometheus-kube-prometheus-alertmanager 9093:9093 -n monitoring
```

## ChatBot Telegram

You can access the Telegram chatbot here:

[DSCS Telegram Bot]([https://t.me/TU_LINK_AQUI](https://t.me/dscs_admin_bot))
