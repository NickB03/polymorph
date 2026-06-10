# Deployment Guide

> **Audience:** Operator
> **Prerequisites:** [Quickstart Guide](../getting-started/QUICKSTART.md)

This page is the navigation hub for deployment operations. Production setup, Phoenix operations, and the evals cron live in focused leaves.

## Recommended targets

Target platform guidance is in the production deployment leaf. See [Production Deployment](DEPLOYMENT-PRODUCTION.md#recommended-targets).

## Production minimum requirements

Required production environment variables are in the production deployment leaf. See [Production Deployment](DEPLOYMENT-PRODUCTION.md#production-minimum-requirements).

## Vercel cron — trending suggestions refresh

The suggestions refresh schedule, auth, and failure modes are in the production deployment leaf. See [Production Deployment](DEPLOYMENT-PRODUCTION.md#vercel-cron--trending-suggestions-refresh).

## Healthcheck expectations

Healthcheck and migration expectations are in the production deployment leaf. See [Production Deployment](DEPLOYMENT-PRODUCTION.md#healthcheck-expectations).

## Rollback strategy

Rollback steps are in the production deployment leaf. See [Production Deployment](DEPLOYMENT-PRODUCTION.md#rollback-strategy).

## Observability (Phoenix on Railway)

Phoenix architecture, persistence checks, tracing setup, and key rotation are in the Phoenix operations leaf. See [Phoenix Operations](PHOENIX-OPERATIONS.md#observability-phoenix-on-railway).

## Persistence verification (run after every Phoenix deploy)

The volume and redeploy acid test are in the Phoenix operations leaf. See [Phoenix Operations](PHOENIX-OPERATIONS.md#persistence-verification-run-after-every-phoenix-deploy).

## Enabling tracing on Vercel

Production tracing env values and masking guidance are in the Phoenix operations leaf. See [Phoenix Operations](PHOENIX-OPERATIONS.md#enabling-tracing-on-vercel).

## Evals cron service

Railway cron behavior, defaults, required env vars, and manual run caveat are in the evals cron leaf. See [Evals Cron Service](EVALS-CRON.md#evals-cron-service).

## Rotating Phoenix API keys

Key rotation order is in the Phoenix operations leaf. See [Phoenix Operations](PHOENIX-OPERATIONS.md#rotating-phoenix-api-keys).

## Staging checklist

The staging checklist is in the production deployment leaf. See [Production Deployment](DEPLOYMENT-PRODUCTION.md#staging-checklist).
