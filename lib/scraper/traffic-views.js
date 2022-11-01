const Prometheus = require('prom-client')
const ghRestApi = require('../github/rest')
const logger = require('../logger')
const helpers = require('../helpers')

class TrafficTopReferrers {
  constructor () {
    this.registerMetrics()
  }

  registerMetrics () {
    this.metrics = {
      githubRepoViewsGauge: new Prometheus.Gauge({
        name: 'github_repo_traffic_views',
        help: 'Total views from top 10 content for given repository',
        labelNames: ['owner', 'repository', 'week']
      }),
      githubRepoViewsUniqueGauge: new Prometheus.Gauge({
        name: 'github_repo_traffic_unique_vistors',
        help: 'Total unique views from top 10 content for given repository',
        labelNames: ['owner', 'repository', 'week']
      }),
      githubRepoViewsAvgGauge: new Prometheus.Gauge({
        name: 'github_repo_traffic_views_avg',
        help: 'Avenge views from top 10 content for given repository',
        labelNames: ['owner', 'repository']
      }),
      githubRepoViewsUniqueAvgGauge: new Prometheus.Gauge({
        name: 'github_repo_traffic_unique_vistors_avg',
        help: 'Avenge unique views from top 10 content for given repository',
        labelNames: ['owner', 'repository']
      })
    }
  }

  scrapeRepositories (repositories) {
    repositories.forEach((repository) => {
      const [owner, repo] = repository.split('/')
      ghRestApi.repos
        .getViews({ owner, repo, per: 'week' })
        .then((response) => {
          this.metrics.githubRepoViewsAvgGauge.set({ owner, repository }, response.data.count)
          this.metrics.githubRepoViewsUniqueAvgGauge.set(
            { owner, repository },
            response.data.uniques
          )

          const currentWeekNumber = helpers.getWeekNumber(new Date())

          const currentWeek = response.data.views.filter(
            (metric) => currentWeekNumber === helpers.getWeekNumber(new Date(metric.timestamp))
          )

          this.metrics.githubRepoViewsGauge.set(
            { owner, repository, week: 'latest' },
            currentWeek.length > 0 ? currentWeek[0].count : 0
          )
          this.metrics.githubRepoViewsUniqueGauge.set(
            { owner, repository, week: 'latest' },
            currentWeek.length > 0 ? currentWeek[0].uniques : 0
          )

          response.data.views
            .filter(
              (metric) => currentWeekNumber !== helpers.getWeekNumber(new Date(metric.timestamp))
            )
            .forEach((metric) => {
              const weekNumber = helpers.getWeekNumber(new Date(metric.timestamp))
              this.metrics.githubRepoViewsGauge.set(
                { owner, repository, week: weekNumber },
                metric.count
              )
              this.metrics.githubRepoViewsUniqueGauge.set(
                { owner, repository, week: weekNumber },
                metric.uniques
              )
            })
        })
        .catch((err) =>
          logger.error(
            `Failed to scrape view metrics for repository ${repository} via REST: ${err.message}`,
            err
          )
        )
    })
  }
}

module.exports = TrafficTopReferrers
