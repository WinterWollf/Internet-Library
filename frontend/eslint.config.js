import nextWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextWebVitals, ...nextTypescript];

export default eslintConfig;
