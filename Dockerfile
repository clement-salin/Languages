# Construction
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Exécution : on ne garde que le résultat de la construction.
# Le serveur n'a aucune dépendance, node_modules n'est donc pas recopié.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server/main.js ./dist-server/main.js

# Le dossier de données doit exister dans l'image et appartenir à `node` :
# Docker initialise un volume nommé neuf à partir de ce qu'il trouve à ce
# chemin. Sans lui, le dossier appartiendrait à root et le serveur, qui
# tourne sans privilèges, ne pourrait pas y écrire sa base.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

EXPOSE 8080
USER node
CMD ["node", "dist-server/main.js"]
