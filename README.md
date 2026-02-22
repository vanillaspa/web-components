## Getting started

To install web-components into your project, simply run

```bash
npm install @vanillaspa/web-components
```

## How-To

Please stick to the following conventions! When working with Vite (recommended), put your components into `src/components` folder. Then add these script-commands to your `package.json`:

```javascript
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
  }
```
Then run

```bash
npm run dev
```

In your code, just import your web-components with:

```
<script type="module">
    import('@vanillaspa/web-components')
</script>
```

After importing web-components, your WebComponents will be defined in the CustemElements registry. You don't have to register your elements manually. Just put them into a seperate folder under src/components.

**Important!** Each WebComponent must be located in your project in a subfolder under `src/components`, for instance, for a component named `<app-start></app-start>` it should be `src/components/app/app-start.html` in order for the import.meta.glob Wildcard-Pattern to work properly.
