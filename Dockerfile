FROM node:10-alpine as builder

# Install app dependencies
COPY package*.json ./
RUN npm install

FROM node:10-alpine

# Bundle app source
# Create app directory
WORKDIR /usr/src/app
COPY --from=builder node_modules node_modules

COPY . .

ENTRYPOINT ["node", "/usr/src/app/index.js"]
