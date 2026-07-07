# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


## [2.9.0] - 2026-07-07

### Changed

- JSDoc and README.md now use .sfc.html file extension
- registerComponents now uses registerSingleComponent
- try-catch now uses currentStage
- render functionality is now completely moved inside connectedCallback

### Removed

- render function 

## [2.8.0] - 2026-07-03 

### Removed

- Requirement for TrustedTypes
- Requirement for unsafe-eval CSP

## [2.6.1] - 2026-07-01

### Removed

- dompurify dependency
- vite-plugin-sfc

### Added

- CHANDELOG.md