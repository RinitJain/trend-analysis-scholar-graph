# ScholarGraph

This is an interactive research visualization tool that helps people understand the evolution of academic ideas over time, built with Next.js and Firebase Studio.

## Getting Started

### Prerequisites

Before running the application, you need to have the following service running locally.

#### Running GROBID with Docker (Recommended)

The application expects the [GROBID](https://grobid.readthedocs.io/en/latest/Introduction/) service to be available at `http://localhost:8070`. The easiest way to run it is with Docker:

```bash
# Recommended for this project (v0.8.2)
docker run --rm --init -e JAVA_OPTS="-Xmx2g" -p 8070:8070 grobid/grobid:0.8.2
```
This will download the official GROBID image and start it on the correct port. The initial download may take some time.

### Running the Development Server

Once the GROBID service is running, you can start the ScholarGraph application.

1.  **Install Dependencies**: Open a terminal in the project's root directory and run:
    ```bash
    npm install
    ```
2.  **Install Playwright Browsers**: Our app uses Playwright for advanced web scraping. Install the necessary browser binaries by running:
    ```bash
    npx playwright install
    ```
3.  **Start the App**: After the installations are complete, run:
    ```bash
    npm run dev
    ```

This will start the Next.js development server. Open [http://localhost:9002](http://localhost:9002) (or the URL shown in your terminal) with your browser to see the result.

The main page at `/` allows you to enter a research topic. The visualization is displayed on the `/graph` page.
