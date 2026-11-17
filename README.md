# STI Survey companion website

Companion website and curated metadata for **Survey on Semantic Interpretation of Tabular Data: Challenges and Directions**, by Marco Cremaschi, Blerina Spahiu, Ernesto Jiménez-Ruiz, and Matteo Palmonari.

- Website: https://cremarco.github.io/sti-survey/
- Source repository: https://github.com/cremarco/sti-survey
- Survey metadata used by the website: [public/data/sti-survey.json](public/data/sti-survey.json)
- Metadata field definitions and UI configuration: [public/data/sti-survey.schema.json](public/data/sti-survey.schema.json)

## Run locally

Install Node.js and npm, then run:

```sh
git clone https://github.com/cremarco/sti-survey.git
cd sti-survey
npm ci
npm run dev
```

Open the local URL printed by Vite. The application uses the `/sti-survey/` base path.

To build the static website and preview it locally:

```sh
npm run build
npm run preview
```

The production build is written to `dist/`.

## Maintain and fork the resource

The React application is in `src/`. Its current dataset is `public/data/sti-survey.json`; archived datasets are retained under `public/data/old/`. The field definitions and display configuration are in `public/data/sti-survey.schema.json`.

To propose a correction or extension, open an issue or submit a pull request. For metadata changes, identify the affected record and include supporting publication or repository links. Check the affected catalogue entries and charts locally and run `npm run build` before submitting.

Forks can run the same code and modify the metadata under the licences below. When hosting under a different repository name or path, update `base` in `vite.config.js` and `homepage` in `package.json` accordingly. The existing [deployment workflow](.github/workflows/deploy.yml) builds and deploys pushes to `main` using GitHub Pages; a fork must configure its own Pages deployment.

## Licensing and attribution

- **Website source code, scripts, and software configuration:** [MIT](LICENSE). Redistribution must retain the copyright and licence notices required by MIT.
- **Original survey metadata, annotations, and curation:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE-DATA), including original contributions in `public/data/`, `approaches/`, and `approaches bk/`. This includes the original metadata field definitions and UI labels. When sharing or adapting this material, give appropriate credit, link to the licence, and indicate changes as required by CC BY 4.0.

Attribution for the curated survey resource should identify Marco Cremaschi, Blerina Spahiu, Ernesto Jiménez-Ruiz, and Matteo Palmonari, the resource title, and this repository.

These licences cover only rights held by the contributors. Third-party dependencies, quoted publication content, and linked papers, code, or datasets retain their respective rights and licence terms. References to other resources do not relicense those resources.

## Citation

For scholarly use, please cite the accompanying survey manuscript and the version of this companion resource that you used. Suggested resource citation:

> Marco Cremaschi, Blerina Spahiu, Ernesto Jiménez-Ruiz, and Matteo Palmonari. *STI Survey companion website and curated metadata*. https://github.com/cremarco/sti-survey. Include the commit identifier and access date.

For reproducibility, cite a specific commit using `https://github.com/cremarco/sti-survey/tree/<commit-sha>`, rather than relying only on the changing default branch. No DOI or archival identifier is assigned by this repository update.
